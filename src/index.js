import Vue from 'vue';
import vuetify from './plugins/vuetify';

import App from './App';

Vue.config.productionTip = false;

new Vue({
  vuetify,
  el: '#app',
  components: { App },
  template: '<App/>',
});
