const TAX_PRESETS = [
  { id: "none", label: "No tax", rate: 0, name: "" },
  { id: "gst", label: "GST 5%", rate: 5, name: "GST" },
  { id: "hst-on", label: "HST 13% (ON)", rate: 13, name: "HST" },
  { id: "hst-nb", label: "HST 15% (NB/NL/NS/PE)", rate: 15, name: "HST" },
  { id: "gst-pst-bc", label: "GST+PST 12% (BC)", rate: 12, name: "GST+PST" },
  { id: "gst-qst-qc", label: "GST+QST 14.975% (QC)", rate: 14.975, name: "GST+QST" },
  { id: "gst-pst-sk", label: "GST+PST 11% (SK)", rate: 11, name: "GST+PST" },
  { id: "gst-rst-mb", label: "GST+RST 12% (MB)", rate: 12, name: "GST+RST" },
  { id: "custom", label: "Custom rate", rate: 0, name: "Tax" },
];

export { TAX_PRESETS };
