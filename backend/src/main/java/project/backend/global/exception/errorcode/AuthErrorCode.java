package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum AuthErrorCode implements ErrorCode{

	UNAUTHORIZED_USER("AUTH-001", "로그인한 사용자만 접근할 수 있습니다.", HttpStatus.UNAUTHORIZED),
	FORBIDDEN_PARTICIPANT("AUTH-002", "해당 채팅방에 참여 중인 사용자만 접근할 수 있습니다.", HttpStatus.FORBIDDEN);

	private final String code;
	private final String message;
	private final HttpStatus status;

}
