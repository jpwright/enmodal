/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    meta: {
      version: '0.1.0'
    },
    banner: '/*! enmodal - v<%= meta.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '* http://enmodal.co/\n' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> ' +
      'Jason Wright; Licensed MIT */\n',
    // Task configuration.
    copy: {
        main: {
            files: [
                {expand: true, flatten: true, src: ['src/js/enmodal/*.js'], dest: 'dist/js/', filter: 'isFile'},
                {expand: true, flatten: true, src: ['src/js/lib/*.min.js'], dest: 'dist/js/', filter: 'isFile'},
                {expand: true, flatten: true, src: ['src/css/*.css'], dest: 'dist/css/', filter: 'isFile'},
                {expand: true, flatten: true, src: ['src/img/*'], dest: 'dist/img/', filter: 'isFile'},
                {expand: true, flatten: true, src: ['src/*.html'], dest: 'dist/', filter: 'isFile'},
            ],
        },
    },
    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true
      },
      dist: {
        src: ['src/js/enmodal/main.js',
              'src/js/enmodal/bezier.js',
              'src/js/enmodal/data-layers.js',
              'src/js/enmodal/components.js',
              'src/js/enmodal/draw.js',
              'src/js/enmodal/image.js',
              'src/js/enmodal/interface.js',
              'src/js/enmodal/markers.js',
              'src/js/enmodal/session.js',
              'src/js/enmodal/settings.js',
              'src/js/enmodal/sharing.js',
              'src/js/enmodal/sidebar.js',
              'src/js/enmodal/station-pair.js',
              'src/js/enmodal/transit.js',
              'src/js/enmodal/utils.js'
        ],
        dest: 'dist/js/enmodal.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: '<%= concat.dist.dest %>',
        dest: 'dist/js/enmodal.min.js'
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'src/js/enmodal/*.js'],
      options: {
        reporterOutput: "",
        globals: {
          jQuery: true
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>', 'src/*.html', 'src/css/*.css'],
      tasks: ['copy', 'concat', 'uglify']
    },
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task.
  grunt.registerTask('default', ['copy', 'concat', 'uglify', 'jshint']);

};
