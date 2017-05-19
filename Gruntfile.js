/*global module:false*/
module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>' +
        ' Licensed <%= pkg.license %> */\n',
        // Task configuration.

        // Currently don't mangle an JS as its causing errors due to the bad coding
        // We want to also concat the css and the js but again there are issues, so we don't
        uglify: {
            source: {
                options: {
                    banner: '<%= banner %>',
                    mangle: false
                    //nameCache: '.tmp/grunt-uglify-cache.json'
                },
                files: [{
                    expand: true,
                    cwd: 'js',
                    src: ['*.js', '!*.min.js'],
                    dest: 'js',
                    rename: function (dst, src) {
                        return dst + '/' + src.replace('.js', '.min.js');
                    }
                }]
            }
        },
        jshint: {
            options: {
                // http://jshint.com/docs/options/
                ignores: ['**/*.min.js'],
                jshintrc: true,
                reporter: require('jshint-stylish')
                //reporterOutput: 'dist/jshint.txt'
            },
            gruntfile: 'Gruntfile.js',
            all: ['js/*.js']

        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            }
        },
        cssmin: {
            options: {
                level: {
                    1: {
                        specialComments: 'none'
                    }
                }
                // Enable to format rathert than minify
                // format: {
                //     breaks: { // controls where to insert breaks
                //         afterAtRule: true, // controls if a line break comes after an at-rule; e.g. `@charset`; defaults to `false`
                //         afterBlockBegins: true, // controls if a line break comes after a block begins; e.g. `@media`; defaults to `false`
                //         afterBlockEnds: false, // controls if a line break comes after a block ends, defaults to `false`
                //         afterComment: true, // controls if a line break comes after a comment; defaults to `false`
                //         afterProperty: true, // controls if a line break comes after a property; defaults to `false`
                //         afterRuleBegins: true, // controls if a line break comes after a rule begins; defaults to `false`
                //         afterRuleEnds: true, // controls if a line break comes after a rule ends; defaults to `false`
                //         beforeBlockEnds: false, // controls if a line break comes before a block ends; defaults to `false`
                //         betweenSelectors: false // controls if a line break comes between selectors; defaults to `false`
                //     },
                //     indentBy: 4, // controls number of characters to indent with; defaults to `0`
                //     indentWith: 'space', // controls a character to indent with, can be `'space'` or `'tab'`; defaults to `'space'`
                //     spaces: { // controls where to insert spaces
                //         aroundSelectorRelation: false, // controls if spaces come around selector relations; e.g. `div > a`; defaults to `false`
                //         beforeBlockBegins: true, // controls if a space comes before a block begins; e.g. `.block {`; defaults to `false`
                //         beforeValue: true // controls if a space comes before a value; e.g. `width: 1rem`; defaults to `false`
                //     },
                //     wrapAt: 100 // controls maximum line length; defaults to `false`
                // },
                // inline: false
            },
            css: {
                files: [{
                    expand: true,
                    cwd: 'css',
                    src: ['*.css', '!*.min.css'],
                    dest: 'css',
                    //ext: '.css // Enable to format rather than minify'
                    ext: '.min.css'
                }]
            }
        },
        war: {
            target: {
                options: {
                    war_dist_folder: 'dist',
                    war_name: '<%= pkg.name %>.<%= pkg.version %>',
                    webxml_welcome: 'index.jsp',
                    webxml_display_name: 'Pedigree Editor Tool'
                },
                files: [
                    {
                        expand: true,
                        cwd: '.',
                        // Not sure if all this is required, but at this point get everything
                        src: ['css/*.min.css', 'js/*.min.js', 'rest/**/*',
                            'resources/font-awesome/css/*.min.css','resources/font-awesome/fonts/*',
                            'resources/icons/silk/*','resources/icons/xwiki/*', 'icons/default.iconset',
                            'index.jsp', 'LICENSE', 'usercheck.html'],
                        dest: ''
                    }
                ]
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-war');

    // Default task.
    grunt.registerTask('default', ['jshint', 'build']);


    grunt.registerTask('build', 'Updates the version in version.js', function () {
        grunt.config.requires('pkg.version');

        var version = grunt.config('pkg.version');
        grunt.log.writeln("Building version " + version);

        grunt.file.write('rest/version.js', "var version = 'v" + version + "';");

        grunt.task.run('uglify', 'cssmin', 'war');

    });

};
