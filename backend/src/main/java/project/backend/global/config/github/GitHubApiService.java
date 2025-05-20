package project.backend.global.config.github;

import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class GitHubApiService {

    private WebClient getWebClient(String gitHubAccessToken) {
        return WebClient.builder()
            .baseUrl("https://api.github.com")
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + gitHubAccessToken)
            .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
            .build();
    }

    public String getPrivateEmail(String gitHubAccessToken) {

        WebClient webClient = getWebClient(gitHubAccessToken);

        List<Map<String, Object>> emailList = webClient.get()
            .uri("/user/emails")
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {
            })
            .block();

        if (emailList == null || emailList.isEmpty()) {
            throw new IllegalStateException("GitHub 이메일 정보를 불러올 수 없습니다.");
        }

        String privateEmail = null;

        for (Map<String, Object> email : emailList) {
            System.out.println(email.get("email"));
            System.out.println("primary = " + email.get("primary"));

            if (Boolean.TRUE.equals(email.get("primary"))) {
                privateEmail = (String) email.get("email");
                break;
            }
        }

        if (privateEmail == null) {
            privateEmail = emailList.getFirst().get("email").toString();
        }

        return privateEmail;

    }
}