package project.backend.domain.member.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@Builder
public class ErrorResponse {

  private final String code;
  private final String message;
  private HttpStatus status;

  public ErrorResponse(String code, String message, HttpStatus status) {
    this.code = code;
    this.message = message;
    this.status = status;
  }
}
