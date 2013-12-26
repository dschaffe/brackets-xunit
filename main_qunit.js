/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets, define, $ */
define(function (require, exports, module) {
    'use strict';
    
    var ProjectManager      = brackets.getModule("project/ProjectManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        MyStatusBar         = require("MyStatusBar"),
        FileProxy           = require("FileProxy"),
        run = function () {
            
            var entry = ProjectManager.getSelectedItem() || DocumentManager.getCurrentDocument().file,
                contents = //If .getText() is depricated we will have to read the file - entry.read(callback)
                    DocumentManager.getCurrentDocument().getText(),
                fileInfo = FileProxy.getTestFileInfo(entry, contents),
                includes = FileProxy.parseIncludes(fileInfo.contents, fileInfo.originalPath, new Date().getTime()),
                useCodeCoverage = true,
                data = {
                    filename : entry.name,
                    title : 'QUnit test - ' + entry.name,
                    includes : includes + "<script src='qunit.js'></script>",
                    templatedir : moduledir,
                    contents : fileInfo.contents,
                    coverage: (useCodeCoverage ? "<script src='qunit.blanket.js'></script>" : "")
                };
            
            $.when(
                FileProxy.createDirectory(fileInfo.testPath)
            ).then(function () {
                
                return $.when(
                    FileProxy.copyFile("text!templates/qunit/qunit.html", fileInfo.testPath, data),
                    FileProxy.copyFile("text!templates/qunit/qunit.js", fileInfo.testPath),
                    FileProxy.copyFile("text!templates/qunit/qunit.blanket.js", fileInfo.testPath),
                    FileProxy.copyFile("text!templates/qunit/qunit.css", fileInfo.testPath)
                ).promise();
                
            }).done(function () {
                var urlToReport = fileInfo.testPath + '/qunit.html' + (useCodeCoverage ? "?coverage=true" : "");
                MyStatusBar.setReportWindow(urlToReport);
            });
            
        };
    exports.run = run;
});