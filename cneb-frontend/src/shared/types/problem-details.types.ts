export interface ValidationErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly invalidParams?: readonly ValidationErrorDetail[];
}

export class ApiProblemException extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiProblemException";
    this.problem = problem;
    Object.setPrototypeOf(this, ApiProblemException.prototype);
  }
}
