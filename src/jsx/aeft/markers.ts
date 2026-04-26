export type MarkerProps = {
  title?: string;
  label?: number;
  duration?: number;
  data?: string;
}

export type MarkerCommentParts = {
  title: string;
  data: string;
  comment: string;
}

export const getMarkerCommentTitle = (comment: string): string => {
  return String(comment || "").split(/\r\n|\n|\r/)[0];
}

export const getMarkerCommentData = (comment: string): string => {
  const fullComment = String(comment || "");
  const lineBreakMatch = /\r\n|\n|\r/.exec(fullComment);
  if (!lineBreakMatch) return "";

  const dataStart = lineBreakMatch.index + lineBreakMatch[0].length;
  return fullComment.substring(dataStart);
}

export const parseMarkerComment = (comment: string): MarkerCommentParts => {
  const fullComment = String(comment || "");

  return {
    title: getMarkerCommentTitle(fullComment),
    data: getMarkerCommentData(fullComment),
    comment: fullComment,
  }
}

export const buildMarkerComment = (title: string, data?: string): string => {
  const markerTitle = String(title || "");
  const markerData = String(data || "");

  return markerData === ""
    ? markerTitle
    : markerTitle + "\n" + markerData;
}

export const createMarkerValue = (markerProps: MarkerProps): MarkerValue => {
  const markerComment = buildMarkerComment(markerProps.title || "", markerProps.data);
  const markerValue = new MarkerValue(markerComment);

  markerValue.label = markerProps.label || 0;
  markerValue.duration = markerProps.duration || 0;

  return markerValue;
}
