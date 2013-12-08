/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 * brackets-xunit - a brackets extension to run various unit test frameworks
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets, define, $, Mustache */
define(function (require, exports) {
    'use strict';
     
    var FileSystem          = brackets.getModule("filesystem/FileSystem"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        getFileName = function (path) {
            var startIndex = path.lastIndexOf("/") || path.lastIndexOf("!") || 0;
            return path.substring(startIndex + 1);
        },
        getFileContents = function (readPath) {
            var dfd = new $.Deferred();
            require([readPath], function (text) {
                dfd.resolve(text);
            });  
            return dfd.promise();
        },
        copyFile = function (readPath, directory, data) {
            //Should make a "Copy files"?
            var dfd = new $.Deferred(),
                me = this,
                writeFile = FileSystem.getFileForPath(directory + "/" + me.getFileName(readPath)),
                contents;
            
            me.getFileContents(readPath)
                .then(function(text) {
                    contents = text;
                    if(data) {
                        contents = Mustache.render(contents, data);
                    }
                    return FileUtils.writeText(writeFile, contents);
                }).done(function() {
                    dfd.resolve(contents);
                });
            
            return dfd.promise();
    
        },
        saveText = function (inputText, writePath) {
            var writeFile = FileSystem.getFileForPath(writePath);
            return FileUtils.writeText(writeFile, inputText);
        },
        getTestFileInfo = function (entry, contents) {
            var fileName = this.getFileName(entry.fullPath),
                fileNameNoExt = fileName.substring(0, fileName.lastIndexOf('.')),
                dirPath = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1);
            return {
                originalPath: dirPath,
                testPath: dirPath + fileNameNoExt,
                contents: contents
            };
        },
        createDirectory = function (path) {
            var dfd = new $.Deferred();
            FileSystem.getDirectoryForPath(path).create(dfd.resolve, dfd.fail);
            return dfd.promise();
        },
        parseIncludes = function (contents, dirPath, cache) {
            var includes = '';
            if (contents && contents.match(/brackets-xunit:\s*includes=/)) {
                var includestr = contents.match(/brackets-xunit:\s*includes=[A-Za-z0-9,\._\-\/\*]*/)[0];
                includestr = includestr.substring(includestr.indexOf('=') + 1);
                
                var includedata = includestr.split(',');
                var i;
                for (i = 0; i < includedata.length; i++) {
                    var includeFile = includedata[i],
                        codeCoverage = '',
                        cacheBuster = cache ? '?u=' + cache : '';
                    if (includeFile[includeFile.length - 1] === "*") {
                        includeFile = includeFile.substring(0, includeFile.length - 1);
                        codeCoverage = ' data-cover';
                        //cacheBuster = '';
                    }
                    includes = includes + '<script src="' + dirPath + includeFile + cacheBuster + '"' + codeCoverage + '></script>\n';
                }
            }
            return includes;
        };
    exports.getFileName = getFileName;
    exports.getFileContents = getFileContents;
    exports.copyFile = copyFile;
    exports.saveText = saveText;
    exports.getTestFileInfo = getTestFileInfo;
    exports.createDirectory = createDirectory;
    exports.parseIncludes =  parseIncludes;
});