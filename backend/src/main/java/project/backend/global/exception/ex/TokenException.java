package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ChatMessageErrorCode;
import project.backend.global.exception.errorcode.TokenErrorCode;

public class TokenException extends BaseException {

	public TokenException(TokenErrorCode errorCode) {
		super(errorCode);
	}
}
