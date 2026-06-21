DOCX REPORT GENERATION — LOCAL LIBRARY FILES
==============================================

These files match the <script>/<link> paths already wired into your
acf-security-assessment.html. Put this whole "libs" folder, plus
sw.js, manifest.json, icon-192.png and icon-512.png (all in the
parent folder, next to the HTML file), and the structure should be:

  acf-security-assessment.html
  sw.js
  manifest.json
  icon-192.png
  icon-512.png
  libs/
  ├── pizzip.min.js       (PizZip 3.2.0)
  ├── docxtemplater.js    (docxtemplater 3.69.0, bundled for <script> use)
  ├── FileSaver.min.js    (file-saver 2.0.5)
  ├── leaflet.js          (Leaflet 1.9.4)
  ├── leaflet.css
  ├── html2canvas.min.js  (html2canvas 1.4.1)
  └── images/             (Leaflet's default marker icons — not
                            currently used since this app uses custom
                            pin icons, kept for safety/compatibility)

WHERE THESE CAME FROM
----------------------
All of these are the official, unmodified browser builds published by
their authors on npm — no changes were made to pizzip.min.js,
FileSaver.min.js, leaflet.js, leaflet.css, or html2canvas.min.js.

docxtemplater.js needed bundling: the npm package only ships
CommonJS source built for bundlers (webpack etc.), not a plug-and-play
<script> file. I bundled docxtemplater 3.69.0 with its @xmldom/xmldom
dependency into a single self-contained file exposing a global
`docxtemplater` variable — same library code, just packaged for direct
browser use.

OFFLINE SATELLITE MAP (Gaza Strip)
------------------------------------
sw.js is a service worker that lets the whole app — and the satellite
map specifically — keep working with zero internet connection. Once
the app is hosted over https:// (service workers require a secure
origin; they do NOT work when opening the HTML file directly via
file://) and opened once, a "📥 Download Satellite Map (Offline)"
button inside the app pre-downloads Esri World Imagery tiles covering
the whole Gaza Strip (zoom 0-17, building-level detail, ~28,300 tiles,
~700MB) into the browser's Cache Storage. After that, the satellite
layer keeps rendering with no connection at all — useful for site
visits with no signal. Street and terrain layers still need internet,
since only satellite was requested for offline use.

manifest.json + icon-192.png/icon-512.png make the app installable to
the phone's home screen ("Add to Home Screen"), so it opens full-screen
like a normal app rather than as a browser tab.

LICENSES
--------
PizZip: MIT. docxtemplater: AGPL-3.0/Commercial — free for personal,
internal, and non-redistributed use; check docxtemplater's license
page before selling/redistributing software built on it. file-saver:
MIT. Leaflet: BSD-2-Clause. html2canvas: MIT.

