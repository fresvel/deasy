<template>
  <div class="col-lg-3 col-md-4" v-if="props.show">
    <div class="smenu">
      <UserProfile photo="/images/avatar.png" :username="props.username" />

      <div class="accordion accordion-flush" id="userMenuAccordion">
        <div v-for="(rol, index) in roles" :key="index" class="accordion-item bg-transparent">
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
              <button
                v-for="(job, jndex) of roles[0].jobs"
                :key="jndex"
                class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                type="button"
                @click="onmenuClick(job.label)"
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
  border-radius: var(--radius-md);
}

.accordion-button {
  background-color: transparent;
  color: var(--brand-white);
  font-weight: 600;
}

.accordion-button:not(.collapsed) {
  color: var(--brand-white);
  box-shadow: none;
}

.accordion-body .list-group-item {
  background-color: transparent;
  color: var(--brand-white);
  border: 0;
  padding-left: 1.5rem;
}
    
    </style>
