FROM docker:cli
RUN apk add --no-cache git
RUN git config --global --add safe.directory /repo \
    && git config --global user.email "updater@terraforming-mars" \
    && git config --global user.name "updater"
COPY update.sh /update.sh
RUN chmod +x /update.sh
CMD ["/update.sh"]
