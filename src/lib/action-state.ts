/** 서버 액션이 폼에 돌려주는 결과 */
export type ActionState = {
  error?: string;
  /** 저장 후 계속 입력 등, 성공했을 때 폼을 초기화하는 신호 */
  savedAt?: number;
  message?: string;
};

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
