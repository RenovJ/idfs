<template>
  <div id="app">
    <Requester/>
  </div>
</template>

<script>
import Requester from './components/Requester'

export default {
  name: 'App',
  components: {
    Requester
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
