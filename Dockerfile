FROM golang:1.12 as build
ENV GO111MODULE=on
WORKDIR /code
ADD go.mod go.sum /code/
RUN go mod download
COPY . .
RUN go build -o forseti-viz main.go


FROM gcr.io/distroless/base
EXPOSE 8080
ENV PORT 8080
WORKDIR /app
COPY . .
COPY --from=build /code /app
ENTRYPOINT ["/app/forseti-viz"]