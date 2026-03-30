<template>
  <div v-if="props.show" class="profile-admin-skin w-full md:w-1/3 xl:w-1/5">
    <div class="smenu">
      <UserProfile photo="/images/avatar.png" :username="props.username" />

      <div class="role-menu">
        <section v-for="(rol, index) in props.roles" :key="index" class="role-menu__item">
          <h2 :id="`user-menu-heading-${index}`" class="role-menu__heading">
            <button
              class="role-menu__trigger"
              :class="{ 'is-open': isRoleOpen(index) }"
              type="button"
              :aria-expanded="String(isRoleOpen(index))"
              :aria-controls="`user-menu-panel-${index}`"
              @click="toggleRole(index)"
            >
              <span>{{ rol.name }}</span>
              <span class="role-menu__indicator" :class="{ 'is-open': isRoleOpen(index) }" aria-hidden="true"></span>
            </button>
          </h2>

          <div
            v-show="isRoleOpen(index)"
            :id="`user-menu-panel-${index}`"
            class="role-menu__panel"
            :aria-labelledby="`user-menu-heading-${index}`"
          >
            <div class="menu-children">
              <button
                v-for="(job, jobIndex) in rol.jobs"
                :key="jobIndex"
                class="menu-children__item"
                type="button"
                @click="onmenuClick(job.label ?? job)"
              >
                <span>{{ job.label ?? job }}</span>
                <span class="menu-children__badge">{{ rol.jobs.length }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, ref } from "vue";
import UserProfile from "@/components/UserProfile.vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: true
  },
  username: {
    type: String,
    default: ""
  },
  roles: {
    type: Array,
    default: () => []
  }
});

const openIndex = ref(null);

const toggleRole = (index) => {
  openIndex.value = openIndex.value === index ? null : index;
};

const isRoleOpen = (index) => openIndex.value === index;

const onmenuClick = () => {};
</script>

<style scoped>
.smenu {
  height: 100vh;
  margin-top: 13px;
  background-color: rgba(var(--brand-primary-rgb), 0.92);
  padding: 0.75rem;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.role-menu__item {
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.role-menu__item:last-child {
  margin-bottom: 0;
}

.role-menu__trigger {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.18);
  color: var(--brand-white);
  font-weight: 600;
  padding: 0.65rem 0.85rem;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.role-menu__trigger.is-open {
  box-shadow: none;
}

.role-menu__indicator {
  width: 0.7rem;
  height: 0.7rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.18s ease;
}

.role-menu__indicator.is-open {
  transform: rotate(-135deg);
}

.menu-children {
  background-color: var(--brand-white);
  margin: 0;
  padding: 0.1rem 0;
}

.menu-children__item {
  width: 100%;
  background-color: transparent;
  color: #1f2933;
  border: 0;
  border-bottom: 1px solid #e3e6ea;
  padding: 0.7rem 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.menu-children__item:last-child {
  border-bottom: 0;
}

.menu-children__badge {
  min-width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: rgba(var(--brand-primary-rgb), 0.12);
  color: var(--brand-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 700;
}
</style>
