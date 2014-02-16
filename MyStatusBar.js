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
    
    var _collapsed          = false,
        jsXunitTemplate     = require("text!templates/panel.html?u=1"),
        Resizer             = brackets.getModule("utils/Resizer"),
        StatusBar           = brackets.getModule("widgets/StatusBar"),
        PanelManager        = brackets.getModule("view/PanelManager"),
        $xunitResults       = {};
        
    function toggleCollapsed(collapsed) {
        if (collapsed === undefined) {
            collapsed = !_collapsed;
        }
        
        _collapsed = collapsed;
        if (_collapsed) {
            Resizer.hide($xunitResults);
        } else {
            //if (JSLINT.errors && JSLINT.errors.length) {
            Resizer.show($xunitResults);
            //}
        }
    }
    
    function statusPassed(message) {
        StatusBar.updateIndicator("XUNIT", true, "xunit-failed", 'Failed');
        $("#XUNIT").text(message);
    }
    function statusFailed(message) {
        StatusBar.updateIndicator("XUNIT", true, "xunit-complete", 'Complete');
        $("#XUNIT").text(message);
    }
    function statusRunning(message) {
        message = message || "running";
        StatusBar.updateIndicator("XUNIT", true, "xunit-process", 'Running');
        $("#XUNIT").text(message);
    }
    function statusCoverage(message) {
        StatusBar.updateIndicator("XUNITCOVERAGE", true, "xunit-complete", 'Complete');
        $("#XUNITCOVERAGE").text(message);
    }
    
    
    function initializePanel() {
        console.log("initializePanel");
        var xunitHtml = Mustache.render(jsXunitTemplate, {}),
            xunitPanel = PanelManager.createBottomPanel("xunit.results", $(xunitHtml), 100);
        $xunitResults = $("#xunit-results");
        
        var xunitStatusHtml = $("<div id=\"xunit-status\" title=\"No xunit errors\">No tests</div>", {}),
            xunitCoverageHtml = $("<div id=\"xunit-coverage\" title=\"No coverage\">No coverage</div>", {});
        $(xunitStatusHtml).insertBefore("#jslint-status");
        $(xunitCoverageHtml).insertBefore("#jslint-status");
        StatusBar.addIndicator("XUNIT", $("#xunit-status"));
        StatusBar.addIndicator("XUNITCOVERAGE", $("#xunit-coverage"));
        StatusBar.updateIndicator("XUNIT", true, "xunit-disabled", 'Xunit');
        StatusBar.updateIndicator("XUNITCOVERAGE", true, "xunit-disabled", 'Xunit');

        //panel.show();
        
        $("#xunit-results .close").click(function () {
            toggleCollapsed(true);
        });

        $("#XUNIT, #XUNITCOVERAGE").click(function () {
            /*if (!$(this).hasClass('xunit-disabled')) {
                if (_xunit_panel_visible) {
                    //Resizer.hide($karmaResults);
                    _xunit_panel_visible = false;
                    //} else {
                    //showPanel();
                    
                }
            }*/
            toggleCollapsed();
        });
        toggleCollapsed(true);
    }
    function setReportWindow(url) {
        $xunitResults.find("#winReport").attr("src", url);
    }
    
    exports.initializePanel = initializePanel;
    exports.toggleCollapsed = toggleCollapsed;
    exports.statusPassed = statusPassed;
    exports.statusFailed = statusFailed;
    exports.statusRunning = statusRunning;
    exports.statusCoverage = statusCoverage;
    exports.setReportWindow = setReportWindow;
});
