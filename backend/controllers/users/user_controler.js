import path from "path";
import fs from "fs-extra";
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";
import UserRepository from "../../services/auth/UserRepository.js";
import { getMariaDBPool } from "../../config/mariadb.js";

const userRepository = new UserRepository();

export const createUser = async (req, res) => {
  console.log("Creando usuario");
  try {
    const userPayload = {
      cedula: req.body.cedula,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name ?? req.body.nombre,
      last_name: req.body.last_name ?? req.body.apellido,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais,
      status: req.body.status,
      verify_email: req.body.verify?.email,
      verify_whatsapp: req.body.verify?.whatsapp,
      photo_url: req.body.photoUrl ?? req.body.photo_url ?? null
    };

    const createdUser = await userRepository.create(userPayload);
    console.log(`Usuario creado en MariaDB con id ${createdUser.id}`);

    if (whatsappBot.isReady && createdUser.whatsapp) {
      try {
        const userName = `${createdUser.first_name ?? createdUser.nombre} ${createdUser.last_name ?? createdUser.apellido}`.trim();
        await whatsappBot.sendWelcomeMessage(createdUser.whatsapp, userName);
        console.log(`Mensaje de bienvenida enviado a ${createdUser.whatsapp}`);
      } catch (error) {
        console.log(`No se pudo enviar mensaje de WhatsApp: ${error.message}`);
      }
    }

    res.json({ result: "ok", user: userRepository.toPublicUser(createdUser) });
  } catch (error) {
    console.log("Error Creating User");
    console.error(error);

    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "La cédula o el correo ya existen",
        error: error.message
      });
    }

    res.status(400).send({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  console.log("Buscando todos los usuarios");

  try {
    const term = req.query?.search ?? "";
    const limit = req.query?.limit ?? 20;
    const status = req.query?.status ?? null;
    const users = await userRepository.search(term, limit, status);
    res.json(users.map((user) => userRepository.toPublicUser(user)));
  } catch (error) {
    console.log("Error Buscando Usuarios");
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
};

export const updateUserPhoto = async (req, res) => {
  const { cedula } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).send({ message: "Debe adjuntar la foto en el campo 'photo'." });
  }

  try {
    const existingUser = await userRepository.findByCedulaOrEmail({ cedula });
    if (!existingUser) {
      await fs.remove(file.path).catch(() => {});
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    const normalizedPath = relativePath.startsWith("uploads/") ? relativePath : `uploads/${relativePath}`;

    const updatedUser = await userRepository.updatePhotoByCedula(cedula, normalizedPath);

    const previousPath = existingUser.photo_url;
    if (previousPath && !previousPath.startsWith("data:")) {
      const absolutePrev = path.resolve(process.cwd(), previousPath.replace(/^\/+/, ""));
      if (await fs.pathExists(absolutePrev)) {
        await fs.remove(absolutePrev).catch(() => {});
      }
    }

    res.json({ result: "ok", user: updatedUser });
  } catch (error) {
    await fs.remove(file.path).catch(() => {});
    console.error("Error actualizando foto de usuario", error);
    res.status(500).send({ message: "Error al actualizar la foto", error: error.message });
  }
};

export const getUserMenu = async (req, res) => {
  try {
    const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
    const userId = Number(userIdRaw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el id del usuario." });
    }

    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }

    const [orgRelationRows] = await pool.query(
      "SELECT id FROM relation_unit_types WHERE code = 'org' LIMIT 1"
    );
    if (!orgRelationRows.length) {
      return res.status(500).json({
        message:
          "No existe relation_unit_types con code='org'. Debe implementarse para construir la jerarquia de unidades."
      });
    }

    const [positions] = await pool.query(
      `SELECT DISTINCT
         up.id AS position_id,
         u.id AS unit_id,
         u.name AS unit_name,
         u.label AS unit_label,
         u.unit_type_id,
         uol.group_unit_id AS group_unit_id,
         gu.name AS group_unit_name,
         gu.label AS group_unit_label,
         c.id AS cargo_id,
         c.name AS cargo_name
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       INNER JOIN units u ON u.id = up.unit_id
       INNER JOIN cargos c ON c.id = up.cargo_id
       LEFT JOIN unit_org_levels uol ON uol.unit_id = u.id
       LEFT JOIN units gu ON gu.id = uol.group_unit_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.is_active = 1
         AND u.is_active = 1
         AND c.is_active = 1
       ORDER BY u.name, c.name`,
      [userId]
    );

    if (!positions.length) {
      return res.json({ user_id: userId, units: [], consolidated: [] });
    }

    const unitsMap = new Map();
    const cargoMapByUnit = new Map();
    const consolidatedMap = new Map();
    const groupMap = new Map();

    const ensureUnitCargoMap = (unitId) => {
      if (!cargoMapByUnit.has(unitId)) {
        cargoMapByUnit.set(unitId, new Map());
      }
      return cargoMapByUnit.get(unitId);
    };

    positions.forEach((row) => {
      const groupUnitId = row.group_unit_id ?? row.unit_id;
      const groupUnitName = row.group_unit_name ?? row.unit_name;
      const groupUnitLabel = row.group_unit_label ?? row.unit_label ?? row.unit_name;

      if (!groupMap.has(groupUnitId)) {
        groupMap.set(groupUnitId, {
          id: groupUnitId,
          name: groupUnitName,
          label: groupUnitLabel,
          units: []
        });
      }

      if (!unitsMap.has(row.unit_id)) {
        unitsMap.set(row.unit_id, {
          id: row.unit_id,
          name: row.unit_name,
          label: row.unit_label ?? row.unit_name,
          group_id: groupUnitId
        });
      }

      const unitCargoMap = ensureUnitCargoMap(row.unit_id);
      if (!unitCargoMap.has(row.cargo_id)) {
        unitCargoMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          processes: []
        });
      }

      if (!consolidatedMap.has(row.cargo_id)) {
        consolidatedMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          processes: []
        });
      }
    });

    const [orgTreeRows] = await pool.query(
      `SELECT ur.parent_unit_id, ur.child_unit_id
       FROM unit_relations ur
       INNER JOIN relation_unit_types rt
         ON rt.id = ur.relation_type_id
        AND rt.code = 'org'`
    );

    const [processRuleRows] = await pool.query(
      `SELECT DISTINCT
         p.id AS process_id,
         p.name AS process_name,
         p.slug AS process_slug,
         pdv.id AS process_definition_id,
         pdv.variation_key,
         pdv.definition_version,
         ptr.id AS rule_id,
         ptr.unit_scope_type,
         ptr.unit_id,
         ptr.unit_type_id,
         ptr.include_descendants,
         ptr.cargo_id,
         ptr.position_id,
         ptr.recipient_policy
       FROM processes p
       INNER JOIN process_definition_versions pdv
         ON pdv.process_id = p.id
        AND pdv.status = 'active'
        AND pdv.effective_from <= CURDATE()
        AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
       INNER JOIN process_target_rules ptr
         ON ptr.process_definition_id = pdv.id
        AND ptr.is_active = 1
        AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
        AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
       WHERE p.is_active = 1
       ORDER BY p.name, ptr.priority, ptr.id`
    );

    const childrenByUnit = new Map();
    orgTreeRows.forEach((row) => {
      if (!childrenByUnit.has(row.parent_unit_id)) {
        childrenByUnit.set(row.parent_unit_id, []);
      }
      childrenByUnit.get(row.parent_unit_id).push(row.child_unit_id);
    });

    const subtreeCache = new Map();
    const getUnitSubtree = (unitId) => {
      if (!unitId) {
        return new Set();
      }
      if (subtreeCache.has(unitId)) {
        return subtreeCache.get(unitId);
      }
      const visited = new Set([unitId]);
      const stack = [unitId];
      while (stack.length) {
        const current = stack.pop();
        const children = childrenByUnit.get(current) || [];
        children.forEach((childId) => {
          if (!visited.has(childId)) {
            visited.add(childId);
            stack.push(childId);
          }
        });
      }
      subtreeCache.set(unitId, visited);
      return visited;
    };

    const positionMatchesRule = (position, rule) => {
      if (rule.position_id) {
        return Number(position.position_id) === Number(rule.position_id);
      }
      if (rule.recipient_policy === "exact_position") {
        return false;
      }
      if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
        return false;
      }
      switch (rule.unit_scope_type) {
        case "all_units":
          return true;
        case "unit_type":
          return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
        case "unit_subtree":
          return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
        case "unit_exact":
        default:
          if (!rule.unit_id) {
            return false;
          }
          if (Number(position.unit_id) === Number(rule.unit_id)) {
            return true;
          }
          if (Number(rule.include_descendants) === 1) {
            return getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
          }
          return false;
      }
    };

    const seenByUnitCargo = new Map();
    const seenByCargo = new Map();

    const addProcess = (cargo, process, seenSet) => {
      if (seenSet.has(process.id)) {
        return;
      }
      cargo.processes.push(process);
      seenSet.add(process.id);
    };

    positions.forEach((position) => {
      const matchingRules = processRuleRows.filter((rule) => positionMatchesRule(position, rule));
      matchingRules.forEach((row) => {
        const process = {
          id: row.process_id,
          name: row.process_name,
          slug: row.process_slug,
          unit_id: position.unit_id,
          process_definition_id: row.process_definition_id,
          variation_key: row.variation_key,
          definition_version: row.definition_version
        };

        const unitCargoMap = cargoMapByUnit.get(position.unit_id);
        if (unitCargoMap?.has(position.cargo_id)) {
          const cargo = unitCargoMap.get(position.cargo_id);
          const key = `${position.unit_id}:${position.cargo_id}`;
          if (!seenByUnitCargo.has(key)) {
            seenByUnitCargo.set(key, new Set());
          }
          addProcess(cargo, process, seenByUnitCargo.get(key));
        }

        if (consolidatedMap.has(position.cargo_id)) {
          if (!seenByCargo.has(position.cargo_id)) {
            seenByCargo.set(position.cargo_id, new Set());
          }
          addProcess(consolidatedMap.get(position.cargo_id), process, seenByCargo.get(position.cargo_id));
        }
      });
    });

    const sortCargos = (cargos) => {
      cargos.forEach((cargo) => {
        cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
      });
      cargos.sort((a, b) => a.name.localeCompare(b.name));
      return cargos;
    };

    const units = Array.from(unitsMap.values())
      .map((unit) => {
        const cargoMap = cargoMapByUnit.get(unit.id);
        const cargos = cargoMap ? Array.from(cargoMap.values()) : [];
        return {
          ...unit,
          cargos: sortCargos(cargos)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    units.forEach((unit) => {
      const group = groupMap.get(unit.group_id);
      if (group) {
        group.units.push(unit);
      }
    });

    const unitGroups = Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        units: group.units.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const consolidated = sortCargos(Array.from(consolidatedMap.values()));

    res.json({ user_id: userId, units, unit_groups: unitGroups, consolidated });
  } catch (error) {
    console.error("Error construyendo el menu del usuario:", error);
    res.status(500).json({ message: "Error al obtener el menú del usuario", error: error.message });
  }
};
