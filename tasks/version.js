/*
 * grunt-assets-wp
 * https://github.com/roots/grunt-assets-wp
 *
 * Base from:
 * https://github.com/yeoman/grunt-filerev
 *
 * Copyright (c) 2014 Hariadi Hinta
 * Licensed under the MIT license.
 */
'use strict';

var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    async = require('async');

module.exports = function(grunt) {

  grunt.registerMultiTask('version', 'WordPress assets revving', function() {

    var options = this.options({
      encoding: 'utf8',
      algorithm: 'md5',
      format: false,
      minify: true,
      minifyname: 'min',
      length: 8,
      rename: false,
      querystring: {}
    });

    options.minifyname = '.' + options.minifyname;

    var querystring = (options.querystring.style && options.querystring.script) ? true : false;

    async.forEach(this.files, function (files, next) {

      files.src.filter(function(file) {
        if (!grunt.file.exists(file)) {
          grunt.log.warn('Source file "' + file + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(file) {

        var basename = path.basename,
            original = basename(file),
            isMinify = (options.minify || options.minifyname.indexOf(original) !== -1) ? true : false,
            name = original.replace(options.minifyname, ''),
            content = grunt.file.read(file),
            hash = crypto.createHash(options.algorithm).update(content, options.encoding).digest('hex'),
            suffix = hash.slice(0, options.length),
            ext = path.extname(file),
            namepart = path.basename(name, ext),
            newName = options.format ?
              [suffix, basename(file, ext), ext.slice(1)].join('.') :
              (isMinify) ?
              [basename(name, ext), suffix + options.minifyname, ext.slice(1)].join('.') :
              [basename(file, ext), suffix, ext.slice(1)].join('.');

        // Get target, find and change references assets to new hashed.
        var wpcontent = grunt.file.read(files.dest), match, re;

        if (querystring) {

          if (ext === '.css') {

            re = new RegExp('(wp_enqueue_style\\(' + '\''+ options.querystring.style +'\'' + ',(\\s*[^,]+,){2})\\s*[^\\)]+\\);');
            newName = '$1 ' + '\''+ suffix +'\'' + ');';

          } else if (ext === '.js') {

            re = new RegExp('(wp_register_script\\(' + '\''+ options.querystring.script +'\'' + ',(\\s*[^,]+,){2})\\s*[^,]+,\\s*([^\\)]+)\\);');
            newName = '$1 ' + '\''+ suffix +'\'' + ', ' + '$3);';

          }

          wpcontent = wpcontent.replace(re, newName);
          grunt.log.writeln('  ' + files.dest.grey + ' update to ' + name.green + ' ('+ suffix.grey +')');
        } else {

          // Copy/rename file base on hash and format
          var resultPath = path.resolve(path.dirname(file), newName);
          if (options.rename) {
            fs.renameSync(file, resultPath);
          } else {
            grunt.file.copy(file, resultPath);
          }

          // Make sure $media for css and $ver for js is null
          // Ref: wp_enqueue_style( $handle, $src, $deps, $ver, $media )
          wpcontent = wpcontent.replace('\''+ hash +'\'', 'null').replace('\''+ suffix +'\'', 'null');

          ext = isMinify ? options.minifyname + ext : ext;
          match = options.format ?
            new RegExp('[a-z0-9]{' + options.length + '}.' + original, 'g') :
            new RegExp(namepart + '.[a-z0-9]{' + options.length + '}' +  ext, 'g');

          re = ( match.test(wpcontent) ) ? match : new RegExp(original, 'g');
          wpcontent = wpcontent.replace(re, newName);
          var status = (options.rename) ? ' rename' : ' change';
          grunt.log.writeln('  ' + file.grey + status + ' to ' + newName.green);
        }
        grunt.file.write(files.dest, wpcontent);

      });
      next();
    }, this.async());
  });
};
