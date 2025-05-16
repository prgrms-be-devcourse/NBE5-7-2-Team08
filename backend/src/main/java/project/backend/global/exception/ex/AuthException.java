package project.backend.global.exception.ex;


import project.backend.global.exception.errorcode.AuthErrorCode;

public class AuthException extends BaseException {
	public AuthException(AuthErrorCode errorCode) {
		super(errorCode);
	}
}

