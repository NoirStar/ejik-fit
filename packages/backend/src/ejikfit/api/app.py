from fastapi import FastAPI


def create_app() -> FastAPI:
    application = FastAPI(title="이직핏 API", version="0.1.0")

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ejik-fit-api"}

    return application


app = create_app()
