package project.backend.global.config.security.dto;

import lombok.Getter;

public record OAuthMemberDto(
	String email,
	String name,
	String login
) {

}
