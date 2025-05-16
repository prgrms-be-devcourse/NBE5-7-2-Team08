package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ChatMessageErrorCode;

public class ChatMessageException extends BaseException {

	public ChatMessageException(ChatMessageErrorCode errorCode) {
		super(errorCode);
	}
}
