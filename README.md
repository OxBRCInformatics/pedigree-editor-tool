## Pedigree Editor v1.0 Readme
Oxford BRC Informatics

Pedigree Editor is offline standalone Pedigree drawing tool based on [Phenotips](https://github.com/phenotips/phenotips) platform.

It is built off the [Panogram Tool](https://github.com/panogram/panogram), however this tool is up-to-date with the PhenoTips
codebase and has had several changes made to the model.

## Features

- Simple and intuitive graphical interface for pedigree drawing
- Follows conventions
- Offline and standalone
- Supported file formats: JSON

## Building

You will need to have nodejs, npm and grunt-cli all installed globally, instructions can be found here [NPM](https://docs.npmjs.com/getting-started/installing-node).

Building a war file will update the version in version.js to the same as package.json, then minify and uglify the CSS and JS files then build a war
file using the minified code.

See gruntfile.js for more info on the specific tasks.

```bash
# Update to latest npm
$ npm install npm@latest -g
# Install grunt cli
$ npm install -g grunt-cli

# Install project dependencies
$ npm install

# Build war artifact
$ grunt build

# Check code using JSHint (currently this has A LOT of errors)
$ grunt jshint
```

## Development

If you wish to work on the code and make use of life updating, currently while we have npm setup we have not configured a runtime for npm,
as all development to this point has been from inside Tomcat. Therefore we recommend softlinking or shortcutting the folder into the webapps folder
of tomcat.

Then start tomcat passing the `-Ddevmode=true` system property, this will make sure the JS & CSS files are all loaded as non-minified code.

We highly recommend the use of JetBrains WebStorm for development as it auto-collapses all .min.js files under their owner .js file,
making the directories a lot easier to read.

## Deployment

New deployment can be done using the war file which can be built using `grunt build`.
Nothing complicated about this, just place into the Tomcat webapps folder.

### Config file

The `config.js` file can only be replaced once the war file is unpacked by Tomcat, however as its JavaScript the config is loaded when the
webpages are requested therefore there's no risk in this.

## Improvements yet to be made

* Combine CSS files into 1 file (configure and use `grunt cssmin`)
* Mangle JS files (configure and use `grunt uglify`), mangling turned off as some of the variable names are single letters which is causing the code
to break when its mangled
* Fix all JSHint issues (use `grunt jshint`)
* Split JS files between libs and src (files which are pre-supplied and those written for the PET)
* Merge src JS files into 1 file for PROD
* Remove all protoype code and replace with jQuery
* Remove the unnecessary code files

## Release Notes

### V1.3.0 Improvements

* `usercheck.html` is now dynamic to its location, expecting it to be deployed in the same url as the `index.jsp`,
which it is now, as its included as part of the war file.
* CSS files are now served as minified files for PROD
* JS files are now served as minified files for PROD
