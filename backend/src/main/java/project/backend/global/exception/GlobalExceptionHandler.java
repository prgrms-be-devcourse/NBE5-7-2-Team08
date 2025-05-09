package project.backend.global.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;
import project.backend.domain.member.dto.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import project.backend.domain.member.MemberErrorCode;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MemberException.class)
  public ErrorResponse handleMemberException(MemberException ex) {
    MemberErrorCode errorCode = ex.getErrorCode();
    return ErrorResponse.builder()
        .code(errorCode.getCode())
        .message(errorCode.getMessage())
        .status(errorCode.getStatus())
        .build();
  }
}
