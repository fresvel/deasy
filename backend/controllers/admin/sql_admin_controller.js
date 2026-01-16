import SqlAdminService from "../../services/admin/SqlAdminService.js";

const service = new SqlAdminService();

export const getSqlMeta = (req, res) => {
  try {
    const tables = service.getMeta();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listSqlRows = async (req, res) => {
  try {
    const { table } = req.params;
    const filters = Object.fromEntries(
      Object.entries(req.query)
        .filter(([key, value]) => key.startsWith("filter_") && value !== undefined && value !== "")
        .map(([key, value]) => [key.replace("filter_", ""), value])
    );
    const rows = await service.list(table, {
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
      orderBy: req.query.orderBy,
      order: req.query.order,
      filters
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const created = await service.create(table, req.body ?? {});
    res.json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const keys = req.body?.keys ?? req.body ?? {};
    const data = req.body?.data ?? req.body ?? {};
    const updated = await service.update(table, keys, data);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const keys = req.body?.keys ?? req.body ?? {};
    const deleted = await service.remove(table, keys);
    res.json({ deleted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
