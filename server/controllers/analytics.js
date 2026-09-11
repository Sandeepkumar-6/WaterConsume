import * as analytics from "../services/analytics.js";
export const dashboard = async (req, res) =>
  res.json(await analytics.dashboard(req.user));
export const monitoring = async (req, res) =>
  res.json(await analytics.monitoring(req.user, req.query));
export const reports = async (req, res) =>
  res.json(await analytics.report(req.user, req.query));
