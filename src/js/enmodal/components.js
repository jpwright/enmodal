// Vue components

Vue.component('modal-city-picker', {
    template: '#template-modal-city-picker',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-import-gtfs', {
  template: '#template-button-import-gtfs',
    props: {
        visible: {type: Boolean, default: true}
    },
});

const STATUS_INITIAL = 0, STATUS_SAVING = 1, STATUS_ANALYZING = 2, STATUS_SUCCESS = 3, STATUS_FAILED = 4;

Vue.component('modal-gtfs-import', {
    template: '#template-modal-gtfs-import',
    props: {
        visible: {type: Boolean, default: true},
        uploadFieldName: 'gtfs',
        fileCount: 0,
    },
    computed: {
      isInitial() {
        return app.upload_status === STATUS_INITIAL;
      },
      isSaving() {
        return app.upload_status === STATUS_SAVING;
      },
      isAnalyzing() {
        return app.upload_status === STATUS_ANALYZING;
      },
      isSuccess() {
        return app.upload_status === STATUS_SUCCESS;
      },
      isFailed() {
        return app.upload_status === STATUS_FAILED;
      },
      gtfsData() {
        return app.gtfsData;
      }
    },
    methods: {
      reset() {
        // reset form to initial state
        this.uploadedFiles = [];
        this.uploadError = null;
        this.gtfsData = null;
      },
      upload(formData, onSuccess, onError) {
        var params = $.param({
            i: enmodal.session_id
        });
        $.ajax({ url: "gtfs_upload?"+params,
            async: true,
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            success: function(data){
              onSuccess([]);
            }
        });
      },
      save(formData) {
        // upload data to the server
        app.upload_status = STATUS_SAVING;

        this.upload(formData, function(x) {
            this.uploadedFiles = [].concat(x);
            app.upload_status = STATUS_ANALYZING;
            var params = $.param({
                i: enmodal.session_id
            });
            $.ajax({ url: "gtfs_analyze?"+params,
              async: true,
              dataType: 'json',
              success: function(data, status) {
                app.upload_status = STATUS_SUCCESS;
                app.gtfsData = data;
                console.log(data);
              }
            });

          }, function(err) {
            this.uploadError = err.response;
            app.upload_status = STATUS_FAILED;
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

var app = new Vue({
    el: '#app',
    data: {
      modal: 'city-picker',
      upload_status: STATUS_INITIAL,
      gtfsData: null,
    }
});