/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets, define, $ */
define(function (require, exports) {
    'use strict';
    
    var ProjectManager      = brackets.getModule("project/ProjectManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        //FileSystem          = brackets.getModule("filesystem/FileSystem"),
        //FileUtils           = brackets.getModule("file/FileUtils"),
        //moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
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
                    jasmineTest : "jasmine-test",
                    title : 'Jasmine test - ' + entry.name,
                    includes : includes,
                    contents : DocumentManager.getCurrentDocument().getText(),
                    coverage : useCodeCoverage ? "<script src='jasmine.blanket.js'></script>" : ""
                },
                htmlFile = data.contents.match(/define\(/) ? 
                    "jasmine_requirejs.html" :
                    "jasmine.html",
                apiFilePath = contents.match(/require\('\.\/[A-Za-z0-9\-]+\.js/);
            
            
            
            $.when(
                FileProxy.createDirectory(fileInfo.testPath)
            ).then(function () {
                var dfd = new $.Deferred();
                if(apiFilePath) {
                    dfd.then(FileProxy.copyFile(fileInfo.originalPath + apiFilePath, fileInfo.testPath));
                }
                dfd.resolve();
                return dfd.promise();
            }).then(function () {
                return $.when(
                  
                FileProxy.copyFile("text!templates/jasmine/" + htmlFile, fileInfo.testPath, data),
                FileProxy.copyFile("text!templates/jasmine/jasmine.css", fileInfo.testPath),
                FileProxy.copyFile("text!templates/jasmine/jquery.js", fileInfo.testPath),
                FileProxy.copyFile("text!templates/jasmine/jasmine.js", fileInfo.testPath),
                FileProxy.copyFile("text!templates/jasmine/jasmineCompleteReporter.js", fileInfo.testPath),
                FileProxy.copyFile("text!templates/jasmine/jasmine-html.js", fileInfo.testPath),
                FileProxy.copyFile("text!templates/jasmine/jasmine.blanket.js", fileInfo.testPath),
                FileProxy.copyFile("text!node/node_modules/jasmine-node/node_modules/requirejs/require.js", fileInfo.testPath)

                ).promise();
                
            }).done(function () {
                var urlToReport = fileInfo.testPath + "/" + htmlFile + (useCodeCoverage ? "?coverage=true" : "");
                MyStatusBar.setReportWindow(urlToReport);
            });
            
        };
    exports.run = run;
});