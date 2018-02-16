// Vue components

Vue.component('modal-city-picker', {
    template: '#template-modal-city-picker',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-pro-gate', {
    template: '#template-modal-pro-gate',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-exporting-pdf', {
    template: '#template-modal-exporting-pdf',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-sharing', {
    template: '#template-modal-sharing',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-session-expired', {
    template: '#template-modal-session-expired',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('collapse-caret', {
    template: '#template-collapse-caret',
    props: {
        visible: {type: Boolean, default: true},
        dataTargetProp: "",
        dataTargetValue: "",
    },
    methods: {
      reset() {
        this.collapsed = false;
      },
      collapse() {
        console.log(this.dataTargetProp);
        console.log(this.dataTargetValue);
        if (this.collapsed) {
          this.collapsed = false;
          $("["+this.dataTargetProp+"='"+this.dataTargetValue+"']").show();
        } else {
          this.collapsed = true;
          $("["+this.dataTargetProp+"='"+this.dataTargetValue+"']").hide();
        }
      },
    },
    mounted() {
      this.reset();
    },
});


Vue.component('button-import-gtfs', {
  template: '#template-button-import-gtfs',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-import-json', {
  template: '#template-button-import-json',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-sharing', {
  template: '#template-button-sharing',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-export-pdf', {
  template: '#template-button-export-pdf',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      exportPdf: function() {
        app.modal = 'exporting-pdf';
        save_pdf(function() {
          app.modal = 'none';
        });
      }
    }
});

Vue.component('button-export-json', {
  template: '#template-button-export-json',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      exportJson: function() {
        save_json(function() {});
      }
    }
});

Vue.component('button-basemap-style', {
  template: '#template-button-basemap-style',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      setBasemap: function(basemap) {
        if (basemap != app.basemapStyle) {
          set_basemap_style(basemap);
          set_basemap_labels(basemap, app.basemapLabels);
          app.basemapStyle = basemap;
        }
      }
    }
});

Vue.component('button-basemap-labels', {
  template: '#template-button-basemap-labels',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      setLabels: function(s) {
        if (s != app.basemapLabels) {
          set_basemap_labels(app.basemapStyle, s);
          app.basemapLabels = s;
        }
      }
    }
});

const STATUS_INITIAL = 0, STATUS_SAVING = 1, STATUS_ANALYZING = 2, STATUS_SUCCESS = 3, STATUS_FAILED = 4, STATUS_IMPORTING = 5;

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
      isImporting() {
        return app.upload_status === STATUS_IMPORTING;
      },
      gtfsImportMap() {
        return app.gtfsImportMap;
      }
    },
    methods: {
      reset: function() {
        // reset form to initial state
        this.uploadedFiles = [];
        this.uploadError = null;
        this.gtfsImportMap = null;
      },
      upload: function(formData, onSuccess, onError) {
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
      save: function(formData) {
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
                app.gtfsImportMap = data;
                console.log(data);
              }
            });

          }, function(err) {
            this.uploadError = err.response;
            app.upload_status = STATUS_FAILED;
          });
      },
      filesChange: function(fieldName, fileList) {
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
      },
      // These methods use jQuery hacks for now until component includes checkbox state
      toggleAgency: function(agency) {
        var agencyState = $("input:checkbox.agency[data-agency-id='"+agency+"']").prop("checked");
        var checkBoxes = $("input:checkbox.route[data-agency-id='"+agency+"']");
        checkBoxes.prop("checked", agencyState);
      },
      selectAll: function() {
        console.log("select all");
        $("input:checkbox.agency").prop('checked', true);
        $("input:checkbox.route").prop('checked', true);
      },
      selectNone: function() {
        console.log("select none");
        $("input:checkbox.agency").prop('checked', false);
        $("input:checkbox.route").prop('checked', false);
      },
      start: function() {
        console.log("importing");
        app.upload_status = STATUS_IMPORTING;

        var services = [];
        var lines = [];

        $("input:checkbox.route").each(function() {
          var state = $(this).prop("checked");
          if (state) {
            var agency = $(this).attr("data-agency-id");
            var route = $(this).attr("data-route-id");
            if (services.indexOf(agency) == -1) {
              services.push(agency);
            }
            if (lines.indexOf(route) == -1) {
              lines.push(route);
            }
          }
        });

        console.log(services);
        console.log(lines);

        var params = $.param({
            i: enmodal.session_id
        });
        var data = {
          "services": services,
          "lines": lines
        };
        $.ajax({ url: "gtfs_import?"+params,
          async: true,
          data: JSON.stringify(data),
          dataType: 'json',
          contentType: "application/json",
          method: 'POST',
          success: function(data, status) {
            app.modal = 'none';
            handle_map_data(data);
          }
        });
      },
    },
    mounted() {
      this.reset();
    },
});

Vue.component('modal-json-import', {
    template: '#template-modal-json-import',
    props: {
        visible: {type: Boolean, default: true},
        uploadFieldName: 'json',
        fileCount: 0,
    },
    computed: {
      isInitial() {
        return app.json_import_status === STATUS_INITIAL;
      },
      isSaving() {
        return app.json_import_status === STATUS_SAVING;
      },
      isSuccess() {
        return app.json_import_status === STATUS_SUCCESS;
      },
      isFailed() {
        return app.json_import_status === STATUS_FAILED;
      }
    },
    methods: {
      reset: function() {
        // reset form to initial state
        this.uploadedFiles = [];
        this.uploadError = null;
        this.jsonImportMap = null;
      },
      upload: function(formData, onSuccess, onError) {
      },
      save: function(file) {
        console.log("importing");
        app.json_import_status = STATUS_SAVING;

        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                // Render thumbnail.
                var data = JSON.parse(e.target.result);
                var jdata = data.map;
                jdata.settings = data.settings;
                handle_map_data(jdata);
                app.json_import_status = STATUS_INITIAL;
                app.modal = 'none';
            };
        })(file);

        var d = reader.readAsText(file);
      },
      filesChange: function(fieldName, fileList) {
        // handle file changes
        const formData = new FormData();

        if (!fileList.length) return;

        // save it
        this.save(fileList[0]);
      },
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
      json_import_status: STATUS_INITIAL,
      gtfsImportMap: null,
      basemapStyle: 'DarkGray',
      basemapLabels: true
    }
});