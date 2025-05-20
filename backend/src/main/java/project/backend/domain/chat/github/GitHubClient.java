package project.backend.domain.chat.github;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import project.backend.global.exception.errorcode.GitHubErrorCode;
import project.backend.global.exception.ex.GitHubException;

@Component
@RequiredArgsConstructor
@Slf4j
public class GitHubClient {

    private final WebClient.Builder webClientBuilder;

    public boolean validateAdminPermission(String accessToken, String owner, String repo) {
        String url = "https://api.github.com/repos/" + owner + "/" + repo; //요청할 api

        Map<String, Object> response = webClientBuilder.build()
            .get()
            .uri(url)
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, error ->
                error.bodyToMono(String.class)
                    .map(errorBody -> {
                        if (error.statusCode() == HttpStatus.UNAUTHORIZED) {
                            log.error(errorBody);
                            return new GitHubException(GitHubErrorCode.INVALID_TOKEN);
                        } else if (error.statusCode() == HttpStatus.NOT_FOUND) {
                            log.error(errorBody);
                            return new GitHubException(GitHubErrorCode.REPO_NOT_FOUND);
                        } else {
                            log.error("GitHubErrorCode.CLIENT_ERROR: {}", errorBody);
                            return new GitHubException(GitHubErrorCode.CLIENT_ERROR);
                        }
                    })
            )
            .onStatus(HttpStatusCode::is5xxServerError, error ->
                error.bodyToMono(String.class)
                    .map(errorBody -> {
                        log.error("GitHubErrorCode.CLIENT_ERROR: {}", errorBody);
                        return new GitHubException(GitHubErrorCode.SERVER_ERROR);
                    })
            )
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {
            })
            .block();

        // jon 응답 구조에서 "permissions": {"admin": true} 이면 레포 접근 권한 있는거임
        if (response == null || !response.containsKey("permissions")) {
            throw new GitHubException(GitHubErrorCode.UNEXPECTED_RESPONSE);
        }

        Map<String, Boolean> permissions = (Map<String, Boolean>) response.get("permissions");
        boolean isAdmin = permissions.getOrDefault("admin", false);

        if (!isAdmin) {
            throw new GitHubException(GitHubErrorCode.UNAUTHORIZED_REPO);
        }

        return true;
    }

    public void registerWebhook(String accessToken, String owner, String repo, String webhookUrl) {
        String apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/hooks";

        Map<String, Object> requestBody = Map.of(
            "name", "web",
            "active", true,
            "events", List.of("issues", "pull_request", "pull_request_review"),
            "config", Map.of(
                "url", webhookUrl,
                "content_type", "json",
                "insecure_ssl", "0"
            )
        );

        try {
            webClientBuilder.build()
                .post()
                .uri(apiUrl)
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github.v3+json")
                .bodyValue(requestBody)
                .retrieve()
                .toBodilessEntity()
                .block();
        } catch (Exception e) {
            log.error("웹훅 등록 중 예외 예상치 못한 발생", e);
            throw new GitHubException(GitHubErrorCode.WEBHOOK_REGISTER_FAILED);
        }
    }
}
