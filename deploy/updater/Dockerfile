FROM docker:cli
RUN apk add --no-cache git
COPY update.sh /update.sh
RUN chmod +x /update.sh
CMD ["/update.sh"]
