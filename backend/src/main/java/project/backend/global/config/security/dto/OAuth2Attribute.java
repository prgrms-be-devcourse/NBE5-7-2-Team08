package project.backend.global.config.security.dto;

import java.util.HashMap;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;
import project.backend.global.exception.errorcode.AuthErrorCode;
import project.backend.global.exception.ex.AuthException;

@Slf4j
public record OAuth2Attribute(
        Map<String, Object> attributes,
        String attributeKey,
        String email,
        String name,
        Long id
) {

    public static OAuth2Attribute of(String provider, String attributeKey,
                                     Map<String, Object> attributes) {
        return switch (provider) {
            case "github" -> ofGithub(attributeKey, attributes);
            default -> {
                log.error("provider = {}", provider);
                throw new AuthException(AuthErrorCode.UNSUPPORTED_PROVIDER);
            }
        };
    }

    private static OAuth2Attribute ofGithub(String attributeKey, Map<String, Object> attributes) {
        Object rawIdObj = attributes.get("id");

        Long id = null;
        if (rawIdObj instanceof Number number) {
            id = number.longValue();
        } else {
            throw new IllegalArgumentException("GitHub 'id' 값이 숫자가 아닙니다: " + rawIdObj);
        }

        return new OAuth2Attribute(
                attributes,
                attributeKey,
                (String) attributes.get("email"),
                (String) attributes.get("name"), // 깃허브는 "name" (대문자 아님 주의!)
                id
        );
    }

    public Map<String, Object> convertToMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("key", attributeKey);
        map.put("name", name);
        map.put("email", email);
        map.put("id", id);
        return map;
    }
}
