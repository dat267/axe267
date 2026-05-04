FROM golang:latest AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM cgr.dev/chainguard/wolfi-base:latest
WORKDIR /
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["/main"]