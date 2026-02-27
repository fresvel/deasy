<template>
  <div class="col-lg-2 col-md-3" v-if="props.show">
    <div class="smenu">
      <UserProfile photo="/images/avatar.png" :username="props.username" />

      <div class="accordion" id="userMenuAccordion">
        <div v-for="(rol, index) in roles" :key="index" class="accordion-item">
          <h2 class="accordion-header" :id="`user-menu-heading-${index}`">
            <button
              class="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              :data-bs-target="`#user-menu-collapse-${index}`"
              aria-expanded="false"
              :aria-controls="`user-menu-collapse-${index}`"
            >
              {{ rol.name }}
            </button>
          </h2>
          <div
            :id="`user-menu-collapse-${index}`"
            class="accordion-collapse collapse"
            :aria-labelledby="`user-menu-heading-${index}`"
            data-bs-parent="#userMenuAccordion"
          >
            <div class="accordion-body p-0">
              <div class="menu-children">
                <button
                  v-for="(job, jndex) of rol.jobs"
                  :key="jndex"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  type="button"
                  @click="onmenuClick(job.label ?? job)"
                >
                  <span>{{ job }}</span>
                  <span class="badge bg-primary rounded-pill">{{ index }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
    
    <script setup>
    
    import {defineProps} from "vue"
import UserProfile from "@/components/UserProfile.vue";

    const props=defineProps({
    show: {
        type: Boolean,
        default: true,
      },
    username: {
        type: String,
        default: "",
    },

    roles:[{
        name: {
            type: String,
            default: "",
        },
        jobs:{
            type:[String],
            default: () => [],
        }
    }]

    })
    
    const onmenuClick = () => {}



    </script>
    
    <style scoped>
    
    
.smenu {
  height: 100vh;
  margin-top: 13px;
  background-color: rgba(var(--brand-primary-rgb), 0.92);
  padding: 0.75rem;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.accordion-item {
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.accordion-item:last-child {
  margin-bottom: 0;
}

.accordion-button {
  background-color: rgba(0, 0, 0, 0.18);
  color: var(--brand-white);
  font-weight: 600;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.accordion-button:not(.collapsed) {
  color: var(--brand-white);
  box-shadow: none;
}

.menu-children {
  background-color: var(--brand-white);
  margin: 0;
  padding: 0.1rem 0;
}

.accordion-body {
  padding: 0;
}

.menu-children .list-group-item {
  background-color: transparent;
  color: #1f2933;
  border: 0;
  border-bottom: 1px solid #e3e6ea;
  padding: 0.7rem 0.9rem;
}

.menu-children .list-group-item:last-child {
  border-bottom: 0;
}
    
    </style>
