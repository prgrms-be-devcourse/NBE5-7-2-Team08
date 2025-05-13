package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ChatRoomErrorCode;

public class ChatRoomException extends BaseException {

	public ChatRoomException(ChatRoomErrorCode errorCode) {
		super(errorCode);
	}
}
