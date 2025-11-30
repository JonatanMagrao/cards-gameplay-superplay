type AppError = Error & { file?: string; line?: number, action?: string };

export const raise = (msg: string, file: string, line: number, action: string): never => {
  const err: AppError = new Error(msg) as AppError;
  err.file = file;
  err.line = line;
  err.action = action
  throw err;
};

export const alertError = (e: any) => {
  const error = e as any
  const msgError = `Error: ${error.message}\n\nLine     : ${error.line}\nAction : ${error.action}\nFile      : ${error.file}`
  alert(msgError)
}

/**
melhorar erro no futuro, para apps proprietários
export type ErrMeta = {
  file?: string;
  line?: number;
  action?: string;
  fn?: string;
  layer?: string;
  layerIndex?: number;
  comp?: string;
  time?: number;
  frame?: number;
};

adicionar $.stack também

 */