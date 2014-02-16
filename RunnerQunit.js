/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, setTimeout, clearTimeout */
define(function (require, exports, module) {
    "use strict";
    
    
    
    
     // Runs a QUnit test
    function run(entry) {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1),
            dirEntry = new NativeFileSystem.DirectoryEntry(dir),
            fname = DocumentManager.getCurrentDocument().filename,
            contents = DocumentManager.getCurrentDocument().getText(),
            testName = entry.fullPath.substring(entry.fullPath.lastIndexOf("/") + 1),
            testBase = testName.substring(0, testName.lastIndexOf('.')),
            qunitReportEntry = new NativeFileSystem.FileEntry(dir + testBase + '/qUnitReport.html'),
            useCodeCoverage = true,
            includes = parseIncludes(contents, dir, new Date().getTime());
        var data = { filename : entry.name,
                     title : 'QUnit test - ' + entry.name,
                     includes : includes + "<script src='qunit.js'></script>",
                     templatedir : moduledir,
                     contents : contents,
                     coverage: (useCodeCoverage ? "<script src='qunit.blanket.js'></script>" : "")
                   };
        var template = require("text!templates/qunit.html");
        var html = Mustache.render(template, data),
        // write generated test report to file on disk
            qunitJs = require("text!thirdparty/test/qunit.js"),
            qunitJsEntry = new NativeFileSystem.FileEntry(dir + testBase + "/qunit.js"),
            qunitJsBlanket = require("text!templates/qunit.blanket.js"),
            qunitJsBlanketEntry = new NativeFileSystem.FileEntry(dir + testBase + "/qunit.blanket.js");
        dirEntry.getDirectory(dir + testBase, {create: true}, function () {
            FileUtils.writeText(qunitJsEntry, qunitJs).done(function () {
                FileUtils.writeText(qunitJsBlanketEntry, qunitJsBlanket).done(function () {
                    FileUtils.writeText(qunitReportEntry, html).done(function () {
                        // launch new window with generated report
                        var urlToReport = qunitReportEntry.fullPath + (useCodeCoverage ? "?coverage=true" : ""),
                            $frame = $xunitResults.find("#winReport"),
                            inter;
                        window.reportComplete = function(result) {
                            if(result.status === "failed") {
                                statusFailed(result.message);
                                toggleCollapsed(false);
                            } else {
                                statusPassed(result.message);   
                            }
                        };
                        window.reportUpdate = function(result) {
                            console.log("update", result);
                            statusRunning(result.message);
                        };
                        window.coverageComplete = function(result) {
                            statusCoverage(result.message);   
                        };
                        $frame.attr("src", urlToReport);
                        
                    });
                });
            });
        });
    }
    
    function setDocumentToWatch(newDocumentToWatch) {
        _cancelCompilation();

        if (documentToWatch) {
            $(documentToWatch).off("change.ContinuousCompilationController");
            documentToWatch.releaseRef();
        }
        
        if (!newDocumentToWatch) {
            documentToWatch = null;
        } else {
            if (newDocumentToWatch.getLanguage()._name !== "JavaScript") {
                documentToWatch = null;
            } else {
                documentToWatch = newDocumentToWatch;
            }
        }
        
        if (!documentToWatch) {
            ContinuousCompilationController.setCodeMirrorToAddHighlightsTo(null);
            ContinuousCompilationController.compileCodeAndDisplayErrors(null);
        } else {
            documentToWatch.addRef();
            $(documentToWatch).on("change.ContinuousCompilationController", function () {
                _runDelayedCompilationForDocument(documentToWatch);
            });

            documentToWatch._ensureMasterEditor();
            ContinuousCompilationController.setCodeMirrorToAddHighlightsTo(documentToWatch._masterEditor._codeMirror);
            _runDelayedCompilationForDocument(documentToWatch);
        }
    }
    
    
    exports.setDocumentToWatch = setDocumentToWatch;
});