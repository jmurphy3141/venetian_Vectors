from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


def run_inference(
    prompt: str,
    *,
    endpoint: str,
    model_id: str,
    compartment_id: str,
    max_tokens: int = 1800,
    temperature: float = 0.2,
    top_p: float = 0.9,
    top_k: int = 0,
    timeout_seconds: int = 180,
    retries: int = 0,
    system_message: str = "",
) -> str:
    """Call OCI Generative AI Inference with Instance Principal auth."""
    try:
        import oci  # type: ignore
    except ImportError as exc:
        raise RuntimeError("OCI SDK is not available. Install requirements.txt.") from exc

    signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
    client = oci.generative_ai_inference.GenerativeAiInferenceClient(
        config={},
        signer=signer,
        service_endpoint=endpoint,
        timeout=(10, timeout_seconds),
    )

    content = oci.generative_ai_inference.models.TextContent()
    content.text = prompt

    message = oci.generative_ai_inference.models.Message()
    message.role = "USER"
    message.content = [content]

    chat_request = oci.generative_ai_inference.models.GenericChatRequest()
    chat_request.api_format = (
        oci.generative_ai_inference.models.BaseChatRequest.API_FORMAT_GENERIC
    )
    chat_request.messages = [message]
    chat_request.max_tokens = max_tokens
    chat_request.temperature = temperature
    chat_request.top_p = top_p
    chat_request.top_k = top_k
    if system_message:
        chat_request.system = system_message

    chat_detail = oci.generative_ai_inference.models.ChatDetails()
    chat_detail.serving_mode = (
        oci.generative_ai_inference.models.OnDemandServingMode(model_id=model_id)
    )
    chat_detail.chat_request = chat_request
    chat_detail.compartment_id = compartment_id

    logger.info("OCI GenAI request model=%s prompt_len=%d", model_id, len(prompt))
    response = None
    for attempt in range(retries + 1):
        try:
            response = client.chat(chat_detail)
            break
        except Exception:
            if attempt >= retries:
                raise
            logger.warning("OCI GenAI request failed; retrying", exc_info=True)
            time.sleep(min(2**attempt, 5))

    if response is None:
        raise RuntimeError("OCI GenAI request did not return a response")

    text = _extract_text(response)
    logger.info("OCI GenAI response len=%d", len(text))
    return text


def _extract_text(response) -> str:
    try:
        choices = response.data.chat_response.choices
        if choices:
            content_list = choices[0].message.content
            if content_list:
                return content_list[0].text or ""
    except AttributeError:
        pass

    try:
        return str(response.data.chat_response.choices[0].message.content)
    except (AttributeError, IndexError, TypeError):
        return str(response)
