brackets-xunit
===========

A brackets extension to detect and run various test tools against the currently edited brackets program.  The plugin
currently supports jasmine and YUI3 unit testing tools.

Installation
===========

1. Find your extensions folder by going to "Help -> Show Extensions Folder"
2. Extract the .zip to your Brackets extension directory
3. Start Brackets and create a unit test in brackets, see the samples directory 
4. Right click on the script file in the sidebar
5. Select Run Unit Test from the context menu
6. The results will appear in new window

Usage
=====

The goal is to get quick feedback when creating unit tests.  The extension detects the file is a unit test, creates an html
file configuring the correct unit test runner, and loads the report in a new brackets window.  

Implementation Notes
============

Currently supports jasmine and YUI3.  The script detects the type by looking for "unittest: jasmine" or "unittest: yui".  

Let me know if you have any suggestions or issues.  Contact me at: dschaffe@adobe.com.

Limitations and Future Enhancements
============

* better detection for unit test in the file.  Should the extension look for a regexp in the test code instead of requiring a special marker?
* Need a way to specify other external libraries to be loaded e.g. the api file.  The script would put these files in script src= tags.
* Should add more unit test frameworks like qunit and also test262

Change Log
=========

03-21-2013 Initial commit
