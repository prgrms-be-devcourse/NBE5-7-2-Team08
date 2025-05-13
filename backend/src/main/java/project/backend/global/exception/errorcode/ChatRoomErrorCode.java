package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ChatRoomErrorCode implements ErrorCode {

	CHATROOM_NOT_FOUND("CRE-001", "채팅방을 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
	NOT_PARTICIPANT("CRE-002", "해당 방에 참여 중인 사용자가 아닙니다.", HttpStatus.FORBIDDEN),
	CHATROOM_NOT_EXIST("CRE-003", "참여 중인 채팅방이 없습니다.", HttpStatus.NOT_FOUND);

	private final String code;
	private final String message;
	private final HttpStatus status;
}
