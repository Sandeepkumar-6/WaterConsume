export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  if (err.code === 11000) {
    status = 409;
    if (err.keyPattern?.email) message = "Email already exists.";
    else if (err.keyPattern?.code) message = "Area code already exists.";
    else if (
      err.keyPattern?.area &&
      err.keyPattern?.type &&
      err.keyPattern?.period
    )
      message = "An alert already exists for this area and period.";
    else message = "A record with these values already exists.";
  }
  if (err.name === "ValidationError" || err.name === "CastError") {
    status = 400;
    message = "Invalid data. Check the required fields and values.";
  }
  if (status === 500) {
    console.error(err);
    message = "Unable to complete the request. Please try again.";
  }
  res.status(status).json({ success: false, message });
}
