package project.backend.global.config.security.dto;

public record OAuthMemberDto(
	String email,
	String nickname,
	String login
) {

}
