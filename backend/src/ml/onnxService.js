import fs from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-node";
import { config } from "../config.js";

let session;
let inputName;
let featureColumns = [];
let labelOutputName;

function resolvePath(inputPath) {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

export async function loadModel() {
  const modelPath = resolvePath(config.model.modelPath);
  const featurePath = resolvePath(config.model.featureColumnsPath);

  const featureRaw = await fs.readFile(featurePath, "utf8");
  featureColumns = JSON.parse(featureRaw);

  session = await ort.InferenceSession.create(modelPath);
  inputName = session.inputNames[0];
  labelOutputName =
    session.outputNames.find((name) => name.toLowerCase().includes("label")) || session.outputNames[0];

  return {
    modelPath,
    featurePath,
    inputName,
    labelOutputName,
    featureCount: featureColumns.length
  };
}

export async function predict(features) {
  if (!session || !inputName) {
    throw new Error("ONNX session not initialized");
  }

  const vector = featureColumns.map((col) => Number(features[col] ?? 0));
  const inputTensor = new ort.Tensor("float32", Float32Array.from(vector), [1, vector.length]);
  const feeds = { [inputName]: inputTensor };
  const outputs = await session.run(feeds, [labelOutputName]);

  const rawLabel = outputs[labelOutputName];
  const labelValue = Array.isArray(rawLabel?.data)
    ? rawLabel.data[0]
    : ArrayBuffer.isView(rawLabel?.data)
      ? rawLabel.data[0]
      : rawLabel?.[0];
  const predictedState = String(labelValue ?? "UNKNOWN");

  return {
    predictedState,
    confidence: null,
    probabilities: null
  };
}

export function getFeatureColumns() {
  return featureColumns;
}
