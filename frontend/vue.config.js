const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
    css:{
      loaderOptions:{
        sass:{
          additionalData: `
            @import "@/scss/_variables.scss";
            @import "@/scss/_bootstrap-variables.scss";
          `
        }
      }
    }
})
