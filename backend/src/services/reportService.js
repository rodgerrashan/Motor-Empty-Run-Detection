import PdfPrinter from "pdfmake";
import { getDb } from "../db/mongo.js";

const fonts = {
  Roboto: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique"
  }
};

const printer = new PdfPrinter(fonts);

function formatDate(date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function computeStats(values) {
  const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (valid.length === 0) return { min: 0, max: 0, avg: 0, count: 0 };
  const sum = valid.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    avg: sum / valid.length,
    count: valid.length
  };
}

export async function generateReport(days = 1) {
  const db = getDb();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [telemetry, alerts, eval_latest] = await Promise.all([
    db
      .collection("telemetry")
      .find({ event_time: { $gte: cutoff } })
      .sort({ event_time: -1 })
      .toArray(),
    db
      .collection("alerts")
      .find({ created_at: { $gte: cutoff } })
      .sort({ created_at: -1 })
      .toArray(),
    db.collection("model_eval").find({}).sort({ created_at: -1 }).limit(1).next()
  ]);

  const current = telemetry[0] || {};
  const rpm_vals = telemetry.map((t) => t.raw?.rpm);
  const vibration_vals = telemetry.map((t) => t.raw?.vibration_hz);
  const current_vals = telemetry.map((t) => t.raw?.current_amp);
  const temp_vals = telemetry.map((t) => t.raw?.temperature_c);

  const rpm_stats = computeStats(rpm_vals);
  const vibration_stats = computeStats(vibration_vals);
  const current_stats = computeStats(current_vals);
  const temp_stats = computeStats(temp_vals);

  const stateDistribution = {};
  for (const t of telemetry) {
    const state = t.predicted_state || "UNKNOWN";
    stateDistribution[state] = (stateDistribution[state] || 0) + 1;
  }

  const abnormalCount = alerts.length;
  const stalledCount = alerts.filter((a) => a.predicted_state === "STALLED").length;
  const emptyRunCount = alerts.filter((a) => a.predicted_state === "EMPTY_RUN").length;

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    content: [
      {
        text: "Motor Efficiency Report",
        style: "header"
      },
      {
        text: `Generated: ${formatDate(new Date())} | Period: Last ${days} day(s)`,
        style: "subheader",
        margin: [0, 0, 0, 20]
      },

      {
        text: "CURRENT STATUS",
        style: "sectionHeader"
      },
      {
        layout: "lightHorizontalLines",
        table: {
          headerRows: 1,
          widths: ["*", "*"],
          body: [
            ["Metric", "Value"],
            ["Motor State", current.predicted_state || "N/A"],
            ["Confidence", `${(current.confidence ?? 0).toFixed(4)}`],
            ["RPM", `${(current.raw?.rpm ?? 0).toFixed(1)}`],
            ["Vibration (Hz)", `${(current.raw?.vibration_hz ?? 0).toFixed(2)}`],
            ["Current (A)", `${(current.raw?.current_amp ?? 0).toFixed(2)}`],
            ["Temperature (°C)", `${(current.raw?.temperature_c ?? 0).toFixed(1)}`],
            ["Last Update", current.event_time ? formatDate(current.event_time) : "N/A"]
          ]
        }
      },

      { text: "\n24-HOUR SUMMARY STATISTICS\n", style: "sectionHeader" },
      {
        layout: "lightHorizontalLines",
        table: {
          headerRows: 1,
          widths: ["*", "*", "*", "*", "*"],
          body: [
            ["Metric", "Min", "Max", "Avg", "Samples"],
            [
              "RPM",
              rpm_stats.min.toFixed(0),
              rpm_stats.max.toFixed(0),
              rpm_stats.avg.toFixed(1),
              rpm_stats.count
            ],
            [
              "Vibration (Hz)",
              vibration_stats.min.toFixed(2),
              vibration_stats.max.toFixed(2),
              vibration_stats.avg.toFixed(2),
              vibration_stats.count
            ],
            [
              "Current (A)",
              current_stats.min.toFixed(2),
              current_stats.max.toFixed(2),
              current_stats.avg.toFixed(2),
              current_stats.count
            ],
            [
              "Temp (°C)",
              temp_stats.min.toFixed(1),
              temp_stats.max.toFixed(1),
              temp_stats.avg.toFixed(1),
              temp_stats.count
            ]
          ]
        }
      },

      { text: "\nOPERATIONAL STATE DISTRIBUTION\n", style: "sectionHeader" },
      {
        layout: "lightHorizontalLines",
        table: {
          headerRows: 1,
          widths: ["*", "*", "*"],
          body: [
            ["State", "Count", "Percentage"],
            ...Object.entries(stateDistribution).map(([state, count]) => [
              state,
              String(count),
              `${((count / telemetry.length) * 100).toFixed(1)}%`
            ])
          ]
        }
      },

      { text: "\nALERT SUMMARY\n", style: "sectionHeader" },
      {
        layout: "lightHorizontalLines",
        table: {
          headerRows: 1,
          widths: ["*", "*"],
          body: [
            ["Alert Type", "Count"],
            ["Total Alerts", abnormalCount],
            ["Stalled", stalledCount],
            ["Empty Run", emptyRunCount],
            ["Other", abnormalCount - stalledCount - emptyRunCount]
          ]
        }
      },

      ...(alerts.length > 0
        ? [
            { text: "\nRECENT ALERTS (Last 20)\n", style: "sectionHeader" },
            {
              layout: "lightHorizontalLines",
              table: {
                headerRows: 1,
                widths: ["*", "*", "*", "*"],
                body: [
                  ["Time", "State", "Alert Code", "Confidence"],
                  ...alerts.slice(0, 20).map((a) => [
                    a.created_at ? formatDate(a.created_at) : "N/A",
                    a.predicted_state || "N/A",
                    a.alert_code || "0",
                    (a.confidence ?? 0).toFixed(4)
                  ])
                ]
              }
            }
          ]
        : []),

      { text: "\nMODEL EVALUATION\n", style: "sectionHeader" },
      ...(eval_latest
        ? [
            {
              layout: "lightHorizontalLines",
              table: {
                headerRows: 1,
                widths: ["*", "*"],
                body: [
                  ["Metric", "Value"],
                  ["Window Size", eval_latest.window_size || "N/A"],
                  ["Mean Confidence", (eval_latest.confidence_mean ?? 0).toFixed(4)],
                  ["Std Dev Confidence", (eval_latest.confidence_std ?? 0).toFixed(4)],
                  ["Updated", eval_latest.created_at ? formatDate(eval_latest.created_at) : "N/A"],
                  [
                    "Class Distribution",
                    Object.entries(eval_latest.class_distribution || {})
                      .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
                      .join(" | ") || "N/A"
                  ]
                ]
              }
            }
          ]
        : [{ text: "No evaluation data available yet.", style: "normal" }]),

      { text: "\n\n---\nEnd of Report", alignment: "center", fontSize: 9, color: "#888" }
    ],
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        color: "#1e293b",
        margin: [0, 0, 0, 10]
      },
      subheader: {
        fontSize: 10,
        color: "#64748b",
        italics: true
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: "#334155",
        margin: [0, 12, 0, 8]
      },
      normal: {
        fontSize: 10,
        color: "#1e293b"
      }
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: "#1e293b"
    }
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);

    pdfDoc.end();
  });
}
