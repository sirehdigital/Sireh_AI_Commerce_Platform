export class CommerceConsoleArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CommerceConsoleArgumentError";
  }
}

export class CommerceConsoleExecutionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CommerceConsoleExecutionError";
  }
}
