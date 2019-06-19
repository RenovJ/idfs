<template>
  <div class="requester">
    <h1>{{ title }}</h1>
    <div>
      <h2>/v0/add_data</h2>
      <b-form @submit="onSubmit_1" @reset="onReset_1">
        <b-form-group
          id="input-group-1-1"
          label="Provider account"
          label-for="input-1-1"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-1-1"
            v-model="api1.provider_account"
            type="text"
            required
            placeholder="ex) alice"
          ></b-form-input>
        </b-form-group>

        <b-form-group
          id="input-group-1-2"
          label="Contract account"
          label-for="input-1-2"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-1-2"
            v-model="api1.contract_account"
            type="text"
            required
            placeholder="ex) osb.trader"
          ></b-form-input>
        </b-form-group>

        <b-form-group
          id="input-group-1-3"
          label="Reserved data ID"
          label-for="input-1-3"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-1-3"
            v-model="api1.reserved_data_id"
            type="number"
            required
          ></b-form-input>
        </b-form-group>

        <b-form-group
          id="input-group-1-4"
          label="Fragment number"
          label-for="input-1-4"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-1-4"
            v-model="api1.fragment_no"
            type="number"
            required
          ></b-form-input>
        </b-form-group>

        <b-form-group
          id="input-group-1-5"
          label="Decrypt key"
          label-for="input-1-5"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-1-5"
            v-model="api1.decrypt_key"
            type="text"
          ></b-form-input>
        </b-form-group>

        <b-form-group
          label="Data type"
          label-cols-sm="4"
          label-cols-lg="3"
          name="data_type"
          v-model="api1.data_type">
          <b-form-radio-group
            v-model="api1.data_type"
            :options="dataTypeOptions"
            name="radio-inline"
          ></b-form-radio-group>
        </b-form-group>

        <b-form-group
          id="input-group-1-6"
          label="Data"
          label-for="input-1-6"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-textarea
            v-if="api1.data_type === 'text'"
            id="input-1-6"
            v-model="api1.data_text"
            required
          ></b-form-textarea>

          <b-form-file
            v-else
            v-model="api1.data_file"
            id="input-1-6"
            placeholder="Choose a file..."
            drop-placeholder="Drop file here..."
          ></b-form-file>
        </b-form-group>

        <div style="text-align:right;">
          <b-button type="submit" variant="primary">Submit</b-button>
          <b-button type="reset" variant="danger">Reset</b-button>
        </div>
      </b-form>
      <b-card class="mt-3" header="Form Data Result">
        <pre class="m-0">{{ api1.response }}</pre>
      </b-card>
    </div>

    <div>
      <h2>/v0/get_data</h2>
      <b-form @submit="onSubmit_2" @reset="onReset_2">
        <b-form-group
          id="input-group-2-1"
          label="cid"
          label-for="input-2-1"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-2-1"
            v-model="api2.cid"
            type="text"
            required
            placeholder="ex) Qm000000000000000000000000000"
          ></b-form-input>
        </b-form-group>

        <div style="text-align:right;">
          <b-button type="submit" variant="primary">Submit</b-button>
          <b-button type="reset" variant="danger">Reset</b-button>
        </div>
      </b-form>
      <b-card class="mt-3" header="Form Data Result">
        <pre class="m-0">{{ api2.response }}</pre>
      </b-card>
    </div>
    <div>
      <h2>/v0/get_decrypt_key</h2>
      <b-form @submit="onSubmit_3" @reset="onReset_3">
        <b-form-group
          id="input-group-3-1"
          label="cid"
          label-for="input-3-1"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-3-1"
            v-model="api3.cid"
            type="text"
            required
            placeholder="ex) Qm000000000000000000000000000"
          ></b-form-input>
        </b-form-group>

        <b-form-group
          id="input-group-3-2"
          label="Public key"
          label-for="input-3-2"
          label-cols-sm="4"
          label-cols-lg="3"
        >
          <b-form-input
            id="input-3-2"
            v-model="api3.public_key"
            type="text"
            required
          ></b-form-input>
        </b-form-group>

        <div style="text-align:right;">
          <b-button type="submit" variant="primary">Submit</b-button>
          <b-button type="reset" variant="danger">Reset</b-button>
        </div>
      </b-form>
      <b-card class="mt-3" header="Form Data Result">
        <pre class="m-0">{{ api3.response }}</pre>
      </b-card>
    </div>
    <div>
      <h2>/v0/get_public_key</h2>
      <b-form @submit="onSubmit_4">
        <div style="text-align:right;">
          <b-button type="submit" variant="primary">Submit</b-button>
        </div>
      </b-form>
      <b-card class="mt-3" header="Form Data Result">
        <pre class="m-0">{{ api4.response }}</pre>
      </b-card>
    </div>

  </div>
</template>

<script src="//unpkg.com/vue"></script>
<script src="//unpkg.com/axios/dist/axios.min.js"></script>
<script>
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

const IDFS_URL = 'http://172.16.1.12:3002'

export default {
  name: 'Requester',
  data () {
    return {
      title: 'OASISBloc IDFS API Requester',
      api1: {
        provider_account: '',
        contract_account: '',
        reserved_data_id: '',
        fragment_no: '',
        decrypt_key: '',
        data_type: 'text',
        data_file: '',
        data_text: '',
        data: '',
        response: ''
      },
      api2: {
        cid: '',
        response: ''
      },
      api3: {
        cid: '',
        public_key: '',
        response: ''
      },
      api4: {
        response: ''
      },
      dataTypeOptions: [
        { text: 'Text', value: 'text' },
        { text: 'File', value: 'file' }
      ]
    }
  },
  methods: {
    showResult (res) {
      if (res.config.url === IDFS_URL+'/v0/add_data') {
        this.api1.response = res
      } else if (res.config.url === IDFS_URL+'/v0/get_data') {
        this.api2.response = res
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', res.config.params.file_name) //or any other extension
        document.body.appendChild(link)
        link.click()
      } else if (res.config.url === IDFS_URL+'/v0/get_decrypt_key') {
        this.api3.response = res
      } else if (res.config.url === IDFS_URL+'/v0/get_public_key') {
        this.api4.response = res
      } else {
        // unreachable
      }
    },
    onSubmit_1(evt) {
      evt.preventDefault()
      if (this.api1.data_type === 'text') {
        this.api1.data = this.api1.data_text
      } else if (this.api1.data_type === 'file') {
        this.api1.data = this.api1.data_file
      }

      let formData = new FormData()
      formData.append('provider_account', this.api1.provider_account);
      formData.append('contract_account', this.api1.contract_account);
      formData.append('reserved_data_id', this.api1.reserved_data_id);
      formData.append('fragment_no', this.api1.fragment_no);
      formData.append('decrypt_key', this.api1.decrypt_key);
      formData.append('data_type', this.api1.data_type);
      if (this.api1.data_type === 'file') {
        formData.append('data', this.api1.data_file);
      } else if (this.api1.data_type === 'text') {
        formData.append('data', this.api1.data_text);
      }

      this.$http.post(IDFS_URL+'/v0/add_data', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      .then(this.showResult)
      .catch(function (error) {
        console.log(error);
      });
    },
    onReset_1(evt) {
      evt.preventDefault()

      this.api1.provider_account = ''
      this.api1.contract_account = ''
      this.api1.reserved_data_id = ''
      this.api1.fragment_no = ''
      this.api1.decrypt_key = ''
      this.api1.data_file = ''
      this.api1.data_text = ''
      this.api1.data = ''
      this.api1.response = ''
    },
    onSubmit_2(evt) {
      evt.preventDefault()
      this.$http.get(IDFS_URL+'/v0/get_data', {
        params: {
          cid: this.api2.cid,
          file_name: this.api2.cid + '.zip'
        }
      })
      .then(this.showResult)
      .catch(function (error) {
        console.log(error);
      });
    },
    onReset_2(evt) {
      evt.preventDefault()

      this.api2.cid = ''
      this.api2.response = ''
    },
    onSubmit_3(evt) {
      evt.preventDefault()
      this.$http.get(IDFS_URL+'/v0/get_decrypt_key', {
        params: {
          cid: this.api3.cid,
          public_key: this.api3.public_key
        }
      })
      .then(this.showResult)
      .catch(function (error) {
        console.log(error);
      });
    },
    onReset_3(evt) {
      evt.preventDefault()

      this.api3.cid = ''
      this.api3.public_key = ''
      this.api3.response = ''
    },
    onSubmit_4(evt) {
      evt.preventDefault()
      this.$http.get(IDFS_URL+'/v0/get_public_key')
      .then(this.showResult)
      .catch(function (error) {
        console.log(error);
      });
    },
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h1, h2 {
  font-weight: normal;
  margin-top: 50px;
}
a {
  color: #42b983;
}
.requester {
  max-width: 800px;
  margin:auto;
}
</style>
