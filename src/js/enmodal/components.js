// Vue components

Vue.component('city-picker', {
    template: '#template-city-picker',
    props: {
        visible: {type: Boolean, default: true}
    },
});

new Vue({
    el: '#modal-city-picker',
    data: {
        visible: true
    }
});

const STATUS_INITIAL = 0, STATUS_SAVING = 1, STATUS_SUCCESS = 2, STATUS_FAILED = 3;

function upload(formData) {
    console.log("uploading GTFS data");
    return 0;
}

Vue.component('gtfs-import', {
    template: '#template-gtfs-import',
    props: {
        visible: {type: Boolean, default: true},
        isInitial: {type: Boolean, default: true},
        isSaving: {type: Boolean, default: false},
        uploadFieldName: {type: String, default: "gtfs"},
    },
    methods: {
      reset() {
        // reset form to initial state
        this.currentStatus = STATUS_INITIAL;
        this.uploadedFiles = [];
        this.uploadError = null;
      },
      save(formData) {
        // upload data to the server
        this.currentStatus = STATUS_SAVING;

        upload(formData)
          .then(x => {
            this.uploadedFiles = [].concat(x);
            this.currentStatus = STATUS_SUCCESS;
          })
          .catch(err => {
            this.uploadError = err.response;
            this.currentStatus = STATUS_FAILED;
          });
      },
      filesChange(fieldName, fileList) {
        // handle file changes
        const formData = new FormData();

        if (!fileList.length) return;

        // append the files to FormData
        Array
          .from(Array(fileList.length).keys())
          .map(x => {
            formData.append(fieldName, fileList[x], fileList[x].name);
          });

        // save it
        this.save(formData);
      }
    },
    mounted() {
      this.reset();
    },
});

new Vue({
    el: '#modal-gtfs-import',
    data: {
        visible: true,
        isInitial: false,
        isSaving: false
    }
});