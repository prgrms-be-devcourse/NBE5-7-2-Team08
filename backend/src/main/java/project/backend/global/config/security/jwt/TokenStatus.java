package project.backend.global.config.security.jwt;

public enum TokenStatus {
	VALID,
	EXPIRED,
	INVALID_SIGNATURE,
	MALFORMED,
	UNKNOWN_ERROR
}
